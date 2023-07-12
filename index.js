"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const redis = require("redis");
const util = require("util");
const KEY = `account1/balance`;
const DEFAULT_BALANCE = 100;
const DEFAULT_UNIT_COST = 5;
const redisClient = new redis.RedisClient({
    host: process.env.ENDPOINT,
    port: parseInt(process.env.PORT || "6379"),
});
redisClient.on('error', error => console.log('Redis client error', error));
exports.chargeRequestRedis = async function (input) {
    await readyRedis();
    const charges = getCharges(parseInt(input.unit || "1"), getUnitCost(input.serviceType));
    const [ isAuthorized, remainingBalance ] = await chargeRedis(KEY, charges);
    if (isAuthorized == 1) {
        return {
            remainingBalance,
            charges,
            isAuthorized: true,
        };
    }
    else {
        return {
            remainingBalance,
            charges: 0,
            isAuthorized: false,
        };
    }
};
exports.resetRedis = async function () {
    await readyRedis();
    await util.promisify(redisClient.set).call(redisClient, KEY, DEFAULT_BALANCE);
    return DEFAULT_BALANCE;
};
function getCharges(unit, unit_cost) {
    return unit * unit_cost;
}
function getUnitCost(serviceType) {
    return DEFAULT_UNIT_COST;
}
async function readyRedis() {
    if (!redisClient.ready) {
        await new Promise((resolve, reject) => {
            redisClient.once('ready', resolve);
        })
        console.log("Waited until Redis client was ready.")
    }
}
async function chargeRedis(key, charges) {
    return util.promisify(redisClient.eval)
        .call(
            redisClient,
            "local charge = tonumber(ARGV[1]); " +
            "local balance = tonumber(redis.call('get', KEYS[1])); " +
            "if balance >= charge then " +
                "balance = balance - charge; " +
                "redis.call('set', KEYS[1], balance); " +
                "return { 1, balance } " +
            "else " +
                "return { 0, balance } " +
            "end",
            1, key, charges
        );
}