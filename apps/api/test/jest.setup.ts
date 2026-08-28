// Imported once before any test file runs (see jest.setupFiles in
// package.json). Normal app boot gets this for free via NestJS's core
// imports in main.ts's chain — Jest test files run in isolation from that
// chain, so without this, any decorator-metadata-dependent code
// (class-validator decorators, NestJS DI decorators) throws
// "Reflect.getMetadata is not a function" the moment a test file imports it.
import 'reflect-metadata';
