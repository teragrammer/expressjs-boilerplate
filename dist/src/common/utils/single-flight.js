"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SingleFlight = void 0;
// src/common/utils/single-flight.ts
/**
 * Coalesces concurrent calls that perform the same work.
 *
 * Without it, a cache miss on a hot key makes every waiting worker
 * query the database at once (a cache stampede). The first caller
 * performs the work; the others await the same promise.
 */
class SingleFlight {
    constructor() {
        this.inFlight = new Map();
    }
    /**
     * Runs `work` unless an identical call is already in progress.
     */
    run(key, work) {
        return __awaiter(this, void 0, void 0, function* () {
            const existing = this.inFlight.get(key);
            if (existing) {
                return existing;
            }
            const promise = (() => __awaiter(this, void 0, void 0, function* () { return work(); }))().finally(() => {
                this.inFlight.delete(key);
            });
            this.inFlight.set(key, promise);
            return promise;
        });
    }
    /**
     * The number of calls currently in progress.
     */
    get size() {
        return this.inFlight.size;
    }
}
exports.SingleFlight = SingleFlight;
