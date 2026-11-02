import assert from "node:assert/strict";
import { parseBankNotice } from "./bank-notice-parser.mjs";
const base = { trustedSender: true, gmailMessageId: "msg-1", subject: "Compra realizada", date: "2026-11-02" };
assert.equal(parseBankNotice({ ...base, text: "Compra por $1.000" }).movement.amount, 1000);
assert.equal(parseBankNotice({ ...base, text: "Compra por $1.000", trustedSender: false }).status, "ignored");
assert.equal(parseBankNotice({ ...base, text: "Compra por $1.000 y saldo $20.000" }).status, "review");
assert.equal(parseBankNotice({ ...base, text: "Compra reversada por $1.000" }).status, "review");
assert.equal(parseBankNotice({ ...base, text: "Compra por $1.000", gmailMessageId: "" }).status, "review");
console.log("Bank notice parser tests passed");
