import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import {
  TerminusModule,
  TypeOrmHealthIndicator,
  TerminusModuleOptions,
} from '@nestjs/terminus';
import { TypeOrmModule } from '@nestjs/typeorm';
import { useAdapter } from '@type-cacheable/redis-adapter';
import * as redis from 'redis';

import graphqlConfig from './configs/graphql.config';
import ormConfig from './configs/orm.config';
import { IS_TESTING } from 'consts/envs';
import { TodoRepository } from './repositories/todo/todo.repository';
import { TodoResolver } from './resolvers/todo/todo.resolver';
import { TodoService } from './services/todo/todo.service';

@Module({
  imports: [
    GraphQLModule.forRoot(graphqlConfig),
    TerminusModule.forRootAsync({
      inject: [TypeOrmHealthIndicator],
      useFactory: (
        typeOrmHealthIndicator: TypeOrmHealthIndicator,
      ): TerminusModuleOptions => ({
        endpoints: [
          {
            healthIndicators: [
              async () => await typeOrmHealthIndicator.pingCheck('database'),
            ],
            url: 'health',
          },
        ],
      }),
    }),
    TypeOrmModule.forRoot(ormConfig),
    TypeOrmModule.forFeature([TodoRepository]),
  ],
  providers: [TodoResolver, TodoService],
})
export class AppModule {
  onModuleInit() {
    const isNotTestingEnvironment = !IS_TESTING;

    if (isNotTestingEnvironment) {
      // Do not register adapter on testing environment. Not needed.
      useAdapter(redis.createClient());
    }
  }
}
