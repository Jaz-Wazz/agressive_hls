import Hls from "hls.js";
import { Loaderx, buffer, sas } from "./agressive_hls";

window.onload = () =>
{
	let player = document.getElementById("player");

	// if(player instanceof HTMLVideoElement)
	// {
	// 	let hls = new Hls({fLoader: AgressiveHls.Loaderx, enableWorker: true, autoStartLoad: false});
	// 	hls.loadSource('http://ia800509.s3dns.us.archive.org/moddychat_2023.07.05_12.05_test/index-dvr.m3u8');
	// 	hls.attachMedia(player);

	// 	player.onplay = () =>
	// 	{
	// 		hls.startLoad();
	// 		if(player != null) player.onplay = () => {};
	// 	};
	// }

	if(player instanceof HTMLVideoElement)
	{
		sas();

		// Make hls loader.
		let hls = new Hls({loader: Loaderx, enableWorker: true});
		hls.loadSource('http://ia800509.s3dns.us.archive.org/moddychat_2023.07.05_12.05_test/index-dvr.m3u8');
		hls.attachMedia(player);
		buffer.handle_events(hls);

		// Handle play event for start deferred load.
		// player.onplay = () =>
		// {
		// 	hls.startLoad();
		// 	if(player != null)
		// 	{
		// 		player.onplay = () => {};
		// 	}
		// };

		// Load sourses.
		// window.onload = () =>
		// {

		// 	if(player instanceof HTMLVideoElement)
		// 	{

		// 	}
		// };
	}
};
