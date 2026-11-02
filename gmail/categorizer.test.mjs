import test from "node:test";
import assert from "node:assert/strict";
import {categorizeMovement, rememberCorrection, mergeImportedMovement} from "./categorizer.mjs";
const categories=["Vivienda","Alimentación","Transporte","Salud","Entretenimiento","Compras personales","Otros"];
test("clasifica comercio conocido",()=>assert.deepEqual(categorizeMovement({merchant:"LIDER EXPRESS"},{categories}),{category:"Alimentación",reviewRequired:false,source:"merchant-rule"}));
test("deja ambiguos pendientes",()=>assert.equal(categorizeMovement({merchant:"COMERCIO XYZ"},{categories}).reviewRequired,true));
test("recuerda corrección con prioridad",()=>{const remembered=rememberCorrection({},"LIDER EXPRESS","Compras personales",categories);assert.equal(categorizeMovement({merchant:"lider express"},{categories,remembered}).category,"Compras personales")});
test("no duplica un mismo correo",()=>{const m={source:"gmail_banco_chile",externalId:"abc"};const r=mergeImportedMovement([m],m);assert.equal(r.inserted,false);assert.equal(r.movements.length,1)});
test("no usa reglas para categoría inexistente",()=>assert.equal(categorizeMovement({merchant:"LIDER"},{categories:["Vivienda","Otros"]}).reviewRequired,true));
