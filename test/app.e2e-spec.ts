import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import faker from 'faker';
import request from 'supertest';

import { AppModule } from '@/app.module';
import { configureApp } from '@/configure';
import { TodoEntity } from '@/entities/todo.entity';

describe('TodoResolver (e2e)', () => {
  let app: INestApplication;
  let createdTodo: TodoEntity;
  let createdSanitizedTodo: TodoEntity;

  const graphlEndpoint = '/graphql';
  const nonExistentTodoId = faker.random.uuid();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    configureApp(app);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('createTodo', () => {
    const operationName = 'CreateTodo';
    const createTodoMutation = `
    mutation ${operationName}($input: CreateTodoInput!) {
      createTodo(input: $input) {
        id
        task
        done
      }
    }
    `;

    it('should return user input errors when task is empty', async () => {
      const payload = {
        operationName,
        query: createTodoMutation,
        variables: { input: { task: '' } },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.errors).toHaveProperty(
            '0.extensions.exception.response.message.0.constraints.isNotEmpty',
            'task should not be empty',
          );
        })
        .expect(200);
    });

    it('should return user input errors when task length is greater than 100', async () => {
      const payload = {
        operationName,
        query: createTodoMutation,
        variables: { input: { task: faker.random.words(101) } },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.errors).toHaveProperty(
            '0.extensions.exception.response.message.0.constraints.maxLength',
            'task must be shorter than or equal to 100 characters',
          );
        })
        .expect(200);
    });

    it('should create a TODO', async () => {
      const input = { task: faker.random.words() };
      const payload = {
        operationName,
        query: createTodoMutation,
        variables: { input },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          createdTodo = response.body.data.createTodo;

          expect(response.body.data.createTodo).toHaveProperty('done', false);
          expect(response.body.data.createTodo).toHaveProperty('id');
          expect(response.body.data.createTodo).toHaveProperty(
            'task',
            input.task,
          );
        })
        .expect(200);
    });

    it('should sanitize and create a TODO', async () => {
      const payload = {
        operationName,
        query: createTodoMutation,
        variables: { input: { task: ' <script></script> ' } },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          createdSanitizedTodo = response.body.data.createTodo;

          expect(response.body.data.createTodo).toHaveProperty('done', false);
          expect(response.body.data.createTodo).toHaveProperty('id');
          expect(response.body.data.createTodo).toHaveProperty(
            'task',
            '&lt;script&gt;&lt;&#x2F;script&gt;',
          );
        })
        .expect(200);
    });
  });

  describe('findTodoById', () => {
    const operationName = 'FindTodoById';
    const findTodoByIdQuery = `
    query ${operationName}($id: ID!) {
      findTodoById(id: $id) {
        id
        task
        done
      }
    }
    `;

    it('should TODO be null when giving inexistent id', async () => {
      const payload = {
        operationName,
        query: findTodoByIdQuery,
        variables: { id: nonExistentTodoId },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.data.findTodoById).toBe(null);
        })
        .expect(200);
    });

    it('should find TODO by id', async () => {
      const payload = {
        operationName,
        query: findTodoByIdQuery,
        variables: { id: createdTodo.id },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.data.findTodoById).toMatchObject(createdTodo);
        })
        .expect(200);
    });
  });

  describe('getAllTodos', () => {
    it('should return a list of TODOS', async () => {
      const operationName = 'GetAllTodos';
      const payload = {
        operationName,
        query: `
        query ${operationName} {
          getAllTodos {
            id
            task
            done
          }
        }
        `,
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.data.getAllTodos).toMatchObject([
            createdTodo,
            createdSanitizedTodo,
          ]);
        })
        .expect(200);
    });
  });

  describe('updateTodo', () => {
    const operationName = 'UpdateTodo';
    const updateTodoMutation = `
    mutation ${operationName}($id: ID!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) {
        id
        task
        done
      }
    }
    `;

    it('should return error when giving inexistent id', async () => {
      const payload = {
        operationName,
        query: updateTodoMutation,
        variables: {
          id: nonExistentTodoId,
          input: { task: faker.random.words() },
        },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.errors).toHaveProperty(
            '0.message',
            `Todo with id "${nonExistentTodoId}" was not found`,
          );
        })
        .expect(200);
    });

    it('should return user input errors when task is empty', async () => {
      const payload = {
        operationName,
        query: updateTodoMutation,
        variables: { id: createdTodo.id, input: { task: '' } },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.errors).toHaveProperty(
            '0.extensions.exception.response.message.0.constraints.isNotEmpty',
            'task should not be empty',
          );
        })
        .expect(200);
    });

    it('should return user input errors when task length is greater than 100', async () => {
      const payload = {
        operationName,
        query: updateTodoMutation,
        variables: {
          id: createdTodo.id,
          input: { task: faker.random.words(101) },
        },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.errors).toHaveProperty(
            '0.extensions.exception.response.message.0.constraints.maxLength',
            'task must be shorter than or equal to 100 characters',
          );
        })
        .expect(200);
    });

    it('should update a TODO', async () => {
      const input = { task: faker.random.words(), done: true };
      const payload = {
        operationName,
        query: updateTodoMutation,
        variables: { input, id: createdTodo.id },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.data.updateTodo).toMatchObject({
            id: createdTodo.id,
            task: input.task,
            done: true,
          });
        })
        .expect(200);
    });

    it('should sanitize and update a TODO', async () => {
      const payload = {
        operationName,
        query: updateTodoMutation,
        variables: {
          id: createdTodo.id,
          input: { task: ' <script></script> ', done: true },
        },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.data.updateTodo).toMatchObject({
            id: createdTodo.id,
            task: '&lt;script&gt;&lt;&#x2F;script&gt;',
            done: true,
          });
        })
        .expect(200);
    });
  });

  describe('removeTodo', () => {
    const operationName = 'RemoveTodo';
    const removeTodoMutation = `
    mutation ${operationName}($id: ID!) {
      removeTodo(id: $id)
    }
    `;

    it('should return error when giving inexistent id', async () => {
      const payload = {
        operationName,
        query: removeTodoMutation,
        variables: { id: nonExistentTodoId },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.errors).toHaveProperty(
            '0.message',
            `Todo with id "${nonExistentTodoId}" was not found`,
          );
        })
        .expect(200);
    });

    it('should remove a TODO', async () => {
      const payload = {
        operationName,
        query: removeTodoMutation,
        variables: { id: createdTodo.id },
      };

      return request(app.getHttpServer())
        .post(graphlEndpoint)
        .send(payload)
        .expect(response => {
          expect(response.body.data.removeTodo).toBe(true);
        })
        .expect(200);
    });
  });
});
