import * as esbuild from "esbuild";
import * as process from "node:process";
import * as fs from "node:fs";

const configurations =
{
	"library":
	{
		entryPoints: ["src/main.ts", "src/main.d.ts"],
		minify: true,
		outdir: "build",
		loader: {".d.ts": "copy"},
		logLevel: "info"
	},
	"examples":
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
		loader: {".html": "copy"},
		logLevel: "info"
	}
};

if(process.argv.includes("--build-library"))
{
	if(process.argv.includes("--only-as-dependency")) if(process.env.INIT_CWD == process.cwd()) process.exit();
	fs.rmSync("build", {recursive: true, force: true});
	await esbuild.build(configurations.library);
	process.exit();
}

if(process.argv.includes("--build-examples"))
{
	fs.rmSync("build", {recursive: true, force: true});
	await esbuild.build(configurations.examples);
	process.exit();
}

if(process.argv.includes("--server"))
{
	fs.rmSync("build", {recursive: true, force: true});
	let ctx = await esbuild.context(configurations.examples);
	await ctx.serve({servedir: "build", port: 8080});
}
