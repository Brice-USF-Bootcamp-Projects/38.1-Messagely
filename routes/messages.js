
const express = require('express');
const router = new express.Router();
const db = require('../db');

/** GET /:id - get detail of message.
 *
 * => {message: {id,
 *               body,
 *               sent_at,
 *               read_at,
 *               from_user: {username, first_name, last_name, phone},
 *               to_user: {username, first_name, last_name, phone}}
 *
 * Make sure that the currently-logged-in users is either the to or from user.
 *
 **/


router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const currentUser = req.currentUser.username;

    // Query message details
    const result = await db.query(
      `
      SELECT m.id, 
             m.body, 
             m.sent_at, 
             m.read_at,
             u1.username AS from_username, 
             u1.first_name AS from_first_name, 
             u1.last_name AS from_last_name, 
             u1.phone AS from_phone,
             u2.username AS to_username, 
             u2.first_name AS to_first_name, 
             u2.last_name AS to_last_name, 
             u2.phone AS to_phone
      FROM messages m
      JOIN users u1 ON m.from_username = u1.username
      JOIN users u2 ON m.to_username = u2.username
      WHERE m.id = $1
      `,
      [id]
    );

    const message = result.rows[0];

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if the user is authorized to view the message
    if (
      currentUser !== message.from_username &&
      currentUser !== message.to_username
    ) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    return res.json({
      message: {
        id: message.id,
        body: message.body,
        sent_at: message.sent_at,
        read_at: message.read_at,
        from_user: {
          username: message.from_username,
          first_name: message.from_first_name,
          last_name: message.from_last_name,
          phone: message.from_phone,
        },
        to_user: {
          username: message.to_username,
          first_name: message.to_first_name,
          last_name: message.to_last_name,
          phone: message.to_phone,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});



/** POST / - post message.
 *
 * {to_username, body} =>
 *   {message: {id, from_username, to_username, body, sent_at}}
 *
 **/
router.post('/', async (req, res, next) => {
    try {
      const { to_username, body } = req.body;
      const from_username = req.currentUser.username;
  
      if (!to_username || !body) {
        return res.status(400).json({ error: "Missing required fields" });
      }
  
      // Insert the message into the database
      const result = await db.query(
        `
        INSERT INTO messages (from_username, to_username, body, sent_at)
        VALUES ($1, $2, $3, current_timestamp)
        RETURNING id, from_username, to_username, body, sent_at
        `,
        [from_username, to_username, body]
      );
  
      const message = result.rows[0];
      return res.status(201).json({ message });
    } catch (err) {
      return next(err);
    }
  });
  

/** POST/:id/read - mark message as read:
 *
 *  => {message: {id, read_at}}
 *
 * Make sure that the only the intended recipient can mark as read.
 *
 **/

router.post('/:id/read', async (req, res, next) => {
    try {
      const { id } = req.params;
      const currentUser = req.currentUser.username;
  
      // Fetch the message to verify recipient
      const result = await db.query(
        `
        SELECT to_username 
        FROM messages 
        WHERE id = $1
        `,
        [id]
      );
  
      const message = result.rows[0];
  
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
  
      // Ensure the current user is the intended recipient
      if (currentUser !== message.to_username) {
        return res.status(403).json({ error: "Unauthorized" });
      }
  
      // Mark the message as read
      const updateResult = await db.query(
        `
        UPDATE messages
        SET read_at = current_timestamp
        WHERE id = $1
        RETURNING id, read_at
        `,
        [id]
      );
  
      const updatedMessage = updateResult.rows[0];
      return res.json({ message: updatedMessage });
    } catch (err) {
      return next(err);
    }
  });
  
module.exports = router;