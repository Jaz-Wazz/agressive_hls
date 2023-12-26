import Hls, { FragmentLoaderContext, HlsConfig, Loader, LoaderCallbacks, LoaderConfiguration, LoaderContext, LoaderStats, PlaylistLevelType, PlaylistLoaderContext } from "hls.js";

export class CustomLoader extends (<new (confg: HlsConfig) => Loader<FragmentLoaderContext>> Hls.DefaultConfig.loader)
{
	constructor(config: HlsConfig)
	{
		let x = new Hls.DefaultConfig.loader(config);
		let y = <new (confg: HlsConfig) => Loader<LoaderContext>> Hls.DefaultConfig.loader;

		let z = (<new (confg: HlsConfig) => Loader<FragmentLoaderContext>> Hls.DefaultConfig.loader);
		let i = new z(config);


		super(config);
		console.log("construct");

		// try
		// {
		// 	console.log("1");
		// 	// let x = new Fragment(PlaylistLevelType.MAIN, "");
		// 	let x = new BaseSegment("");
		// 	console.log("2");
		// }
		// catch(error: any)
		// {
		// 	console.log("xxx");
		// 	console.log(error);
		// }

		// this.context.

		// this.context = {part: null, url: "url", responseType: "arraybuffer", frag: new Fragment(PlaylistLevelType.MAIN, "base_url")};
	}

	// async load(context: PlaylistLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>)
	// {
	// 	// context.ty
	// }

	async load(context: LoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>)
	{
		console.log("load");


		// let playlist_context = <PlaylistLoaderContext> context;
		// let fragmanet_context = <FragmentLoaderContext> context;

		// if(playlist_context.type !== undefined)
		// {
		// 	console.log("Fragment");
		// 	let response = await fetch(context.url);
		// 	let buffer = await response.text();
		// 	callbacks.onSuccess({url: context.url, data: buffer}, this.stats, context, null);
		// }
		// else
		// {
		// 	console.log("Playlist");
		// 	console.log(context);
		// }






		// inherits()


		// if(typeof context === 'number')
		// {

		// }

		// console.log(x);
		// console.log(y);

		// if(typeof context === PlaylistLoaderContext)
		// {

		// }


		// x.

		// let x = (PlaylistLoaderContext)context;

		// context.ty

		// if(context instanceof PlaylistLoaderContext)
		// {

		// }

			// if(context == PlaylistLoaderContext)
			// {

			// }
			// if(context == FragmentLoaderContext)
			// {

			// }


		// if(x.type == "manifest")
		// {
		// 	let response = await fetch(x.url);
		// 	let buffer = await response.text();
		// 	callbacks.onSuccess({url: x.url, data: buffer}, this.stats, x, null);
		// }
		// else
		// {
		// 	console.error(x);
		// }
	}

	// async load(context: FragmentLoaderContext, config: LoaderConfiguration, callbacks: LoaderCallbacks<LoaderContext>)
	// {
	// 	if(context.type == "manifest")
	// 	{
	// 		let response = await fetch(context.url);
	// 		let buffer = await response.text();
	// 		callbacks.onSuccess({url: context.url, data: buffer}, this.stats, context, null);
	// 	}
	// 	else
	// 	{
	// 		console.error(context);
	// 	}
	// }

	abort(): void
	{
		console.log("abort");
	}
}
