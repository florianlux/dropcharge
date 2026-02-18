import { Logger } from '@netlify/dev-utils';

interface ImagesConfig {
    remote_images: string[];
}
interface ImageHandlerOptions {
    imagesConfig?: ImagesConfig;
    logger: Logger;
    originServerAddress?: string;
}
interface ImageMatch {
    handle: (originServerAddress: string) => Promise<Response>;
}
declare class ImageHandler {
    #private;
    constructor({ logger, imagesConfig }: ImageHandlerOptions);
    private generateIPXRequestURL;
    match(request: Request): ImageMatch | undefined;
}

export { ImageHandler, type ImageMatch };
