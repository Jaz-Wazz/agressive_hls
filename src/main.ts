import Hls from "hls.js";
import { CustomLoader } from "./agressive_hls";

window.onload = () =>
{
	let player = document.getElementById("player");

	if(player instanceof HTMLVideoElement)
	{
		let hls = new Hls({fLoader: CustomLoader, enableWorker: true});
		hls.loadSource('http://ia800509.s3dns.us.archive.org/moddychat_2023.07.05_12.05_test/index-dvr.m3u8');
		hls.attachMedia(player);
	}
	else
	{
		console.error("Not find #player.");
	}
};
