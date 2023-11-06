import Hls from "hls.js";

window.onload = () =>
{
	let player = document.getElementById("player");

	if(player instanceof HTMLVideoElement)
	{
		let hls = new Hls({enableWorker: true, autoStartLoad: false});
		hls.loadSource('http://ia800509.s3dns.us.archive.org/moddychat_2023.07.05_12.05_test/index-dvr.m3u8');
		hls.attachMedia(player);

		player.onplay = () =>
		{
			hls.startLoad();
			if(player != null) player.onplay = () => {};
		};
	}
};
