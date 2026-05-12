import { compile } from "svelte/compiler";

const source = `<script>export let name = "edge";</script><h1>Hello {name}</h1>`;
const result = compile(source, { generate: "server", dev: false, name: "EdgeComponent" });
console.log(result.js.code);
console.log("--- imports above show why raw eval in Worker needs an import strategy for svelte/internal/server");
