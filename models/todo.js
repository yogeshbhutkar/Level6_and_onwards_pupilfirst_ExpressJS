"use strict";
const { Model, where } = require("sequelize");
const { Op } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Todo extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // define association here
      Todo.belongsTo(models.User, {
        foreignKey: "userId",
      });
    }

    static addTodo({ title, dueDate, userId }) {
      return this.create({
        title: title,
        dueDate: dueDate,
        completed: false,
        userId,
      });
    }

    static getTodos(uid) {
      return this.findAll({
        where: {
          id: uid,
        },
      });
    }

    markAsCompleted() {
      return this.update({ completed: true });
    }

    setCompletionStatus(val) {
      return this.update({ completed: val });
    }

    static async overdue(userId) {
      return await Todo.findAll({
        where: {
          dueDate: {
            [Op.lt]: new Date(),
          },
          userId,
          completed: {
            [Op.eq]: false,
          },
        },
        order: [["id", "ASC"]],
      });
    }

    static async dueToday(userId) {
      return await Todo.findAll({
        where: {
          dueDate: {
            [Op.eq]: new Date(),
          },
          userId,
          completed: {
            [Op.eq]: false,
          },
        },
        order: [["id", "ASC"]],
      });
    }

    static async dueLater(userId) {
      return await Todo.findAll({
        where: {
          dueDate: {
            [Op.gt]: new Date(),
          },
          userId,
          completed: {
            [Op.eq]: false,
          },
        },
        order: [["id", "ASC"]],
      });
    }

    static async getCompleted(userId) {
      return await Todo.findAll({
        where: {
          completed: {
            [Op.eq]: true,
          },
          userId,
        },
        order: [["id", "ASC"]],
      });
    }

    static async remove(id, userId) {
      return this.destroy({
        where: {
          id,
          userId,
        },
      });
    }
  }

  Todo.init(
    {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notNull: true,
          len: 5,
        },
      },
      dueDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        validate: {
          notNull: true,
        },
      },
      completed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize,
      modelName: "Todo",
    }
  );
  return Todo;
};
