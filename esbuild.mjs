import * as esbuild from "esbuild";

let opts =
{
	entryPoints:
	[
		"examples/browser_player/main.html",
		"examples/browser_player/main.css",
		"examples/browser_player/main.ts",
		"examples/buffer_playground/main.html",
		"examples/buffer_playground/main.css",
		"examples/buffer_playground/main.ts"
	],
	bundle: true,
	minify: true,
	sourcemap: true,
	outdir: "build",
	loader: {".html": "copy"}
};

if(process.argv[2] == "--build")
{
	await esbuild.build(opts);
}

if(process.argv[2] == "--server")
{
	let ctx = await esbuild.context(opts);
	await ctx.serve({servedir: "build"});
}
