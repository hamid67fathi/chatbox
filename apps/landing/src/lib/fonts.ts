import localFont from "next/font/local";

const fontDir = "../../public/fonts";

export const vazirmatn = localFont({
	src: [
		{ path: `${fontDir}/Vazirmatn-Light.ttf`, weight: "300", style: "normal" },
		{ path: `${fontDir}/Vazirmatn-Regular.ttf`, weight: "400", style: "normal" },
		{ path: `${fontDir}/Vazirmatn-Medium.ttf`, weight: "500", style: "normal" },
		{
			path: `${fontDir}/Vazirmatn-SemiBold.ttf`,
			weight: "600",
			style: "normal",
		},
		{ path: `${fontDir}/Vazirmatn-Bold.ttf`, weight: "700", style: "normal" },
		{
			path: `${fontDir}/Vazirmatn-ExtraBold.ttf`,
			weight: "800",
			style: "normal",
		},
		{ path: `${fontDir}/Vazirmatn-Black.ttf`, weight: "900", style: "normal" },
	],
	variable: "--font-vazir",
	display: "swap",
});

export const cormorant = localFont({
	src: [
		{
			path: `${fontDir}/CormorantGaramond-Light.ttf`,
			weight: "300",
			style: "normal",
		},
		{
			path: `${fontDir}/CormorantGaramond-LightItalic.ttf`,
			weight: "300",
			style: "italic",
		},
		{
			path: `${fontDir}/CormorantGaramond-Regular.ttf`,
			weight: "400",
			style: "normal",
		},
		{
			path: `${fontDir}/CormorantGaramond-Italic.ttf`,
			weight: "400",
			style: "italic",
		},
		{
			path: `${fontDir}/CormorantGaramond-SemiBold.ttf`,
			weight: "600",
			style: "normal",
		},
		{
			path: `${fontDir}/CormorantGaramond-Bold.ttf`,
			weight: "700",
			style: "normal",
		},
	],
	variable: "--font-display",
	display: "swap",
});

export const dmSans = localFont({
	src: [
		{ path: `${fontDir}/DMSans-Regular.ttf`, weight: "400", style: "normal" },
		{ path: `${fontDir}/DMSans-Medium.ttf`, weight: "500", style: "normal" },
		{ path: `${fontDir}/DMSans-SemiBold.ttf`, weight: "600", style: "normal" },
		{ path: `${fontDir}/DMSans-Bold.ttf`, weight: "700", style: "normal" },
	],
	variable: "--font-dm-sans",
	display: "swap",
});
