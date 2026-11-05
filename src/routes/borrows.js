import express from "express";
import { ObjectId } from "mongodb";
import { getBooksCollection, getBorrowsCollection } from "../db.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// borrow-এর মেয়াদ (দিন)
const BORROW_DURATION_DAYS = 7;

// POST /borrows -> বই ধার (private)
router.post("/", verifyToken, async (req, res) => {
  try {
    const { bookId } = req.body;

    if (!bookId || !ObjectId.isValid(bookId)) {
      return res.status(400).json({ message: "Invalid book id" });
    }

    const books = getBooksCollection();
    const borrows = getBorrowsCollection();

    const book = await books.findOne({ _id: new ObjectId(bookId) });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    // Challenge: একই বই একই user দুইবার borrow করতে পারবে না
    const alreadyBorrowed = await borrows.findOne({
      bookId: book._id.toString(),
      userEmail: req.user.email,
    });
    if (alreadyBorrowed) {
      return res
        .status(409)
        .json({ message: "You have already borrowed this book" });
    }

    // Challenge: copy না থাকলে borrow যাবে না
    if (book.availableCopies <= 0) {
      return res.status(400).json({ message: "No copies available" });
    }

    const borrowDate = new Date();
    const returnDate = new Date(
      borrowDate.getTime() + BORROW_DURATION_DAYS * 24 * 60 * 60 * 1000
    );

    const newBorrow = {
      bookId: book._id.toString(),
      bookTitle: book.title,
      bookImage: book.image,
      userEmail: req.user.email,
      borrowDate,
      returnDate,
    };

    await borrows.insertOne(newBorrow);
    await books.updateOne(
      { _id: book._id },
      { $inc: { availableCopies: -1 } }
    );

    res.status(201).json({ message: "Book borrowed successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to borrow book" });
  }
});

// GET /borrows -> লগইন করা user-এর borrows (private)
router.get("/", verifyToken, async (req, res) => {
  try {
    const result = await getBorrowsCollection()
      .find({ userEmail: req.user.email })
      .sort({ borrowDate: -1 })
      .toArray();
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch borrows" });
  }
});

// DELETE /borrows/:id -> বই ফেরত (private, শুধু নিজের borrow)
router.delete("/:id", verifyToken, async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid borrow id" });
    }

    const borrows = getBorrowsCollection();
    const borrow = await borrows.findOne({ _id: new ObjectId(req.params.id) });

    if (!borrow) {
      return res.status(404).json({ message: "Borrow record not found" });
    }
    if (borrow.userEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: "Forbidden: you can only return your own borrows" });
    }

    await borrows.deleteOne({ _id: new ObjectId(req.params.id) });
    await getBooksCollection().updateOne(
      { _id: new ObjectId(borrow.bookId) },
      { $inc: { availableCopies: 1 } }
    );

    res.json({ message: "Book returned successfully" });
  } catch (err) {
    res.status(500).json({ message: "Failed to return book" });
  }
});

export default router;
