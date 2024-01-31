import mongoose, {isValidObjectId} from "mongoose"
import { Todo } from "../models/todo.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getAllTodos = asyncHandler(async(req,res) => {
    const { query, complete } = req.query;
    const todos = await Todo.aggregate([
    {
    $match: query?.length > 0
        ? 
            {
            title: {
                $regex: query.trim(),
                $options: "i",
            },
            }
        : {},
    },
    {
    $match: complete
        ? {
            isComplete: JSON.parse(complete),
        }
        : {},
    },
    {
    $sort: {
        updatedAt: -1,
    },
    },
]);

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            todos,
            "Todos fetched successfully"
            )
        );
});

const getTodoById = asyncHandler(async(req,res) => {
    const {todoId} = req.params;

    if (!todoId || !isValidObjectId(todoId)) {
        throw new ApiError(400, "Invalid Todo id");
    }

    const todo = await Todo.findById(todoId)

    if (!todo) {
        throw new ApiError(404, "Todo does not exist");
    }
    
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                todo,
                "Todo fetched successfully"
                )
            )

})

const createTodo = asyncHandler(async(req,res) => {
    const {title,description} = req.body;

    if (!title) {
        throw new ApiError(400, "Todo title is required")
    }

    const todo = await Todo.create({
        title,
        description
    })

    return res
    .status(200)
    .json(
        new ApiResponse(
            200,
            todo,
            "Todo create successfully"
        )
        )

})

const updateTodo = asyncHandler(async(req,res) => {
    const {todoId} = req.params
    const {title,description} = req.body;

    if (!todoId || !isValidObjectId(todoId)) {
        throw new ApiError(400, "Invalid Todo id");
    }
    if (!title) {
        throw new ApiError(400,"Todo title is required")
    }

    const todo = await Todo.findByIdAndUpdate(
        todoId,
        {
            $set: {
                title,
                description
            }
        },
        {
            new: true
        }
    )

    if (!todo) {
        throw new ApiError(404, "Todo does not exist");
    }
    
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                todo,
                "Todo updated successfully"
                )
            );
})

const deleteTodo = asyncHandler(async(req,res) => {
    const {todoId} = req.params

    if (!todoId || !isValidObjectId(todoId)) {
        throw new ApiError(400, "Invalid Todo id");
    }

    const todo = await Todo.findByIdAndDelete(todoId)

    if (!todo) {
        throw new ApiError(404, "Todo does not exist");
    }

    return res
        .status(200)
        .json(
        new ApiResponse(
            200,
            { deletedTodo: todo },
            "Todo deleted successfully"
            )
        );
})

const toggleTodoDoneStatus = asyncHandler(async(req,res) => {
    const {todoId} = req.params;

    if (!todoId || !isValidObjectId(todoId)) {
        throw new ApiError(400, "Invalid Todo id");
    }

    try {
        const todo = await Todo.findById(todoId)
    
        if (!todo) {
            throw new ApiError("Video does not existed")
        }
    
        todo.isComplete = !todo.isComplete
    
        await todo.save({validateBeforeSave: false})
    
        return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                todo,
                "Todo marked " + todo.isComplete ? "done" : "undone"
                )
            )
    
    } catch (error) {
        throw new ApiError(500,error?.message || "Internal Server Error")
    }

})


export {
    getAllTodos,
    getTodoById,
    createTodo,
    updateTodo,
    deleteTodo,
    toggleTodoDoneStatus,
};