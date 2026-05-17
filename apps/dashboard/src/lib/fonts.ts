import localFont from "next/font/local";

export const vazirmatn = localFont({
	src: [
		{
			path: "../../public/fonts/Vazirmatn-Light.ttf",
			weight: "300",
			style: "normal",
		},
		{
			path: "../../public/fonts/Vazirmatn-Regular.ttf",
			weight: "400",
			style: "normal",
		},
		{
			path: "../../public/fonts/Vazirmatn-Medium.ttf",
			weight: "500",
			style: "normal",
		},
		{
			path: "../../public/fonts/Vazirmatn-SemiBold.ttf",
			weight: "600",
			style: "normal",
		},
		{
			path: "../../public/fonts/Vazirmatn-Bold.ttf",
			weight: "700",
			style: "normal",
		},
		{
			path: "../../public/fonts/Vazirmatn-ExtraBold.ttf",
			weight: "800",
			style: "normal",
		},
		{
			path: "../../public/fonts/Vazirmatn-Black.ttf",
			weight: "900",
			style: "normal",
		},
	],
	variable: "--font-vazir",
	display: "swap",
});

export const dmSans = localFont({
	src: [
		{
			path: "../../public/fonts/DMSans-Light.ttf",
			weight: "300",
			style: "normal",
		},
		{
			path: "../../public/fonts/DMSans-Regular.ttf",
			weight: "400",
			style: "normal",
		},
		{
			path: "../../public/fonts/DMSans-Medium.ttf",
			weight: "500",
			style: "normal",
		},
		{
			path: "../../public/fonts/DMSans-SemiBold.ttf",
			weight: "600",
			style: "normal",
		},
		{
			path: "../../public/fonts/DMSans-Bold.ttf",
			weight: "700",
			style: "normal",
		},
	],
	variable: "--font-dm-sans",
	display: "swap",
});

export const dmMono = localFont({
	src: [
		{
			path: "../../public/fonts/DMMono-Regular.ttf",
			weight: "400",
			style: "normal",
		},
		{
			path: "../../public/fonts/DMMono-Medium.ttf",
			weight: "500",
			style: "normal",
		},
	],
	variable: "--font-dm-mono",
	display: "swap",
});
