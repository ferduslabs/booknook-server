import express from "express";
import { ObjectId } from "mongodb";
import { getBooksCollection } from "../db.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

const CATEGORIES = ["Fiction", "Science", "History", "Kids", "Others"];

// GET /books  -> সব বই (public)
// query: limit, sort, email
//   /books?limit=6&sort=-createdAt  -> New Arrivals
//   /books?email=user@mail.com      -> My Books
router.get("/", async (req, res) => {
  try {
    const books = getBooksCollection();

    const limit = parseInt(req.query.limit, 10) || 0;
    const sortField = req.query.sort?.replace("-", "") || "createdAt";
    const sortOrder = req.query.sort?.startsWith("-") ? -1 : 1;

    const filter = {};
    if (req.query.email) {
      filter.userEmail = req.query.email;
    }

    const result = await books
      .find(filter)
      .sort({ [sortField]: sortOrder })
      .limit(limit)
      .toArray();

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch books" });
  }
});

// GET /books/:id -> একটি বই
router.get("/:id", async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }
    const book = await getBooksCollection().findOne({
      _id: new ObjectId(req.params.id),
    });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json(book);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch book" });
  }
});

// POST /books -> বই যোগ (private)
router.post("/", verifyToken, async (req, res) => {
  try {
    const { title, author, category, image, description, totalCopies } =
      req.body;

    if (!title || !author || !image || !description) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (category && !CATEGORIES.includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }

    const copies = Math.max(1, parseInt(totalCopies, 10) || 1);

    const newBook = {
      title,
      author,
      category: category || "Others",
      image,
      description,
      totalCopies: copies,
      availableCopies: copies,
      userName: req.body.userName || "",
      userEmail: req.user.email,
      createdAt: new Date(),
    };

    const result = await getBooksCollection().insertOne(newBook);
    res.status(201).json({ ...newBook, _id: result.insertedId });
  } catch (err) {
    res.status(500).json({ message: "Failed to add book" });
  }
});

// PATCH /books/:id -> বই আপডেট (private, শুধু যে যোগ করেছে)
router.patch("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const books = getBooksCollection();
    const book = await books.findOne({ _id: new ObjectId(req.params.id) });

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    if (book.userEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "Forbidden: you can only edit your own books" });
    }

    const { title, author, category, image, description, totalCopies } =
      req.body;
    const update = {};

    if (title !== undefined) update.title = title;
    if (author !== undefined) update.author = author;
    if (image !== undefined) update.image = image;
    if (description !== undefined) update.description = description;
    if (category !== undefined) {
      if (!CATEGORIES.includes(category)) {
        return res.status(400).json({ message: "Invalid category" });
      }
      update.category = category;
    }
    // totalCopies বাড়ালে/কমালে availableCopies ঠিক রাখা হচ্ছে
    if (totalCopies !== undefined) {
      const newTotal = Math.max(0, parseInt(totalCopies, 10) || 0);
      const diff = newTotal - book.totalCopies;
      update.totalCopies = newTotal;
      update.availableCopies = Math.max(0, book.availableCopies + diff);
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    await books.updateOne({ _id: new ObjectId(req.params.id) }, { $set: update });
    res.json({ message: "Book updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to update book" });
  }
});

// DELETE /books/:id -> বই ডিলিট (private, শুধু owner)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const books = getBooksCollection();
    const book = await books.findOne({ _id: new ObjectId(req.params.id) });

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    if (book.userEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "Forbidden: you can only delete your own books" });
    }

    await books.deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete book" });
  }
});

export default router;
