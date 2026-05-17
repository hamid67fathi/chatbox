/**
 * Vazirmatn embedded in the widget bundle (no CDN, no runtime fetch from API).
 */
import vazirLight from "../assets/fonts/Vazirmatn-Light.ttf";
import vazirRegular from "../assets/fonts/Vazirmatn-Regular.ttf";
import vazirMedium from "../assets/fonts/Vazirmatn-Medium.ttf";
import vazirSemiBold from "../assets/fonts/Vazirmatn-SemiBold.ttf";
import vazirBold from "../assets/fonts/Vazirmatn-Bold.ttf";

function face(
	dataUrl: string,
	weight: number,
	style = "normal",
): string {
	return `
@font-face {
  font-family: 'Vazirmatn';
  src: url(${dataUrl}) format('truetype');
  font-weight: ${weight};
  font-style: ${style};
  font-display: swap;
}`;
}

export const WIDGET_FONT_FACES = [
	face(vazirLight, 300),
	face(vazirRegular, 400),
	face(vazirMedium, 500),
	face(vazirSemiBold, 600),
	face(vazirBold, 700),
].join("");
