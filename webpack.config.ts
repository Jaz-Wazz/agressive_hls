import webpack from "webpack";
import _ from "webpack-dev-server";
import CopyPlugin from "copy-webpack-plugin";

const config: webpack.Configuration =
{
	mode: "development",
	entry: "./src/main.ts",
	devtool: 'source-map',
	module:
	{
		rules:
		[
			{
				test: /\.tsx?$/,
				use: "ts-loader",
				exclude: /node_modules/
			},
			{
				test: /\.css$/,
				use: ["style-loader", "css-loader"]
			},
		]
	},
	devServer:
	{
		static: "./dist",
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
			writeToDisk: true
		}
	},
	plugins:
	[
		new CopyPlugin({patterns: ["./src/main.html", "./src/main.css"]})
	]
};

export default config;
