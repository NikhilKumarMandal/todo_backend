import { Router } from "express";

import {
    createTodo,
    deleteTodo,
    getAllTodos,
    getTodoById,
    toggleTodoDoneStatus,
    updateTodo,
} from "../controllers/todo.controller.js";
import {verifyJWT} from "../middlewares/auth.middleware.js"




const router = Router();
router.use(verifyJWT);

router
    .route("/")
    .post(createTodo)
    .get(getAllTodos);

router
    .route("/:todoId")
    .get(getTodoById)
    .patch(updateTodo)
    .delete(deleteTodo);

router
    .route("/toggle/status/:todoId")
    .patch(toggleTodoDoneStatus);

export default router;