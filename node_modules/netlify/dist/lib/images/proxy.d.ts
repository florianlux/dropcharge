import type { IncomingMessage, ServerResponse } from 'http';
import { type ImageHandler } from '@netlify/images';
import type { ServerSettings } from '../../utils/types.d.ts';
export declare const IMAGE_URL_PATTERN = "/.netlify/images";
export declare const isImageRequest: (req: IncomingMessage) => boolean;
export declare const initializeProxy: ({ settings, imageHandler, }: {
    settings: ServerSettings;
    imageHandler: ImageHandler;
}) => (req: IncomingMessage, res: ServerResponse) => Promise<void>;
//# sourceMappingURL=proxy.d.ts.map