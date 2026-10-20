import { opening, collection, product, lab, mobile } from './site.mjs';
import { accounting, formats } from './accounting.mjs';
import { closing } from './closing.mjs';

// Order here is the order of the final video.
export const SCENES = [opening, collection, product, lab, mobile, accounting, formats, closing];
