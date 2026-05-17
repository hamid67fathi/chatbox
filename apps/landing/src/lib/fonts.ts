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

export const cormorant = localFont({
	src: [
		{
			path: "../../public/fonts/CormorantGaramond-Light.ttf",
			weight: "300",
			style: "normal",
		},
		{
			path: "../../public/fonts/CormorantGaramond-LightItalic.ttf",
			weight: "300",
			style: "italic",
		},
		{
			path: "../../public/fonts/CormorantGaramond-Regular.ttf",
			weight: "400",
			style: "normal",
		},
		{
			path: "../../public/fonts/CormorantGaramond-Italic.ttf",
			weight: "400",
			style: "italic",
		},
		{
			path: "../../public/fonts/CormorantGaramond-SemiBold.ttf",
			weight: "600",
			style: "normal",
		},
		{
			path: "../../public/fonts/CormorantGaramond-Bold.ttf",
			weight: "700",
			style: "normal",
		},
	],
	variable: "--font-display",
	display: "swap",
});

export const dmSans = localFont({
	src: [
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
