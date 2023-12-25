import webpack from "webpack";
import _ from "webpack-dev-server";

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
		}
	}
};

export default config;
