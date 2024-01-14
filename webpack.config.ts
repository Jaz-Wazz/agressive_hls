import webpack from "webpack";
import _ from "webpack-dev-server";
import CopyPlugin from "copy-webpack-plugin";
import path from "path";

const config: webpack.Configuration =
{
	mode: "development",
	entry:
	{
		"browser_player": "./examples/browser_player/main.ts"
	},
	devtool: 'source-map',
	output:
	{
		path: path.resolve(__dirname, "./build"),
		filename: "[name]/main.js",
		clean: true
	},
	module:
	{
		rules:
		[
			{
				test: /\.tsx?$/,
				use: "ts-loader",
				exclude: /node_modules/
			}
		],
	},
	resolve:
	{
		extensions: [".ts", ".tsx", ".js"]
	},
	devServer:
	{
		static: "./build",
		liveReload: false,
		hot: false,
		client:
		{
			logging: "warn",
			reconnect: false,
			overlay: false
		},
		devMiddleware:
		{
			writeToDisk: true,
			index: "main.html"
		}
	},
	plugins:
	[
		new CopyPlugin({patterns:
		[
			{from: "./examples/browser_player/main.html", to: "browser_player/main.html"},
			{from: "./examples/browser_player/main.css", to: "browser_player/main.css"},
			{from: "./node_modules/plyr/dist/plyr.css", to: "browser_player/plyr.css"},
		]})
	]
};

export default config;
