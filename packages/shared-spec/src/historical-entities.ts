/**
 * Historical Entity Mapper & Lexicon Facade
 * Re-exports modularized domain submodules from ./entities/* and ./text-utils
 * for 100% backward compatibility across monorepo packages.
 */

export * from './entities/index.js';
export { removeVietnameseAccents } from './text-utils.js';
