export async function loadImage(imageName: string): Promise<HTMLImageElement> {
    return new Promise<HTMLImageElement>((resolve) => {
        var image: HTMLImageElement = new Image();
        image.src = imageName;
        image.onload = () => {
            resolve(image);
        };
    });
}
export function toRadians(x: number): number {
    return x * (Math.PI / 180);
}
export function millisToSeconds(s: number): number {
    return s * 0.001;
}
export async function loadFile(url: string): Promise<string> {
    return new Promise<string>(async (resolve, reject) => {
        fetch(url).then(async (response: Response) => {
            if (response.ok) {
                resolve(await response.text());
            } else {
                reject(new Error(`HTTP Response code for file ${url}: ${response.status}-${response.statusText}!`))
            }
        });
    })
}
export async function createContext(): Promise<WebGL2RenderingContext> {
    return new Promise<WebGL2RenderingContext>(async (resolve, reject) => {
        var canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.id = "webgl_canvas";
        document.body.appendChild(canvas);
        let gl: WebGL2RenderingContext = canvas.getContext("webgl2");
        if (gl) {
            resolve(gl);
        } else {
            reject(new Error("Couldn't acquire WebGL2Context!"));
        }
    });
}