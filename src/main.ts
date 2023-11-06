import Hls from "hls.js";

if(Hls.isSupported())
{
	let x: number = 5;
	console.log("hls supported!", x);
}
