import { loadImage } from "./Util.js";
export class Texture {
    texture: WebGLTexture;
    static activeTextures: number = 0;
    static textures: Texture[] = [];
    public activateTexture(gl: WebGL2RenderingContext): void {
        gl.activeTexture(WebGL2RenderingContext.TEXTURE0 + Texture.activeTextures);
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, this.texture);
        Texture.activeTextures++;
    }
    public disableTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, null);
        Texture.activeTextures--;
    }
    public bindTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, this.texture);
    }
    public unbindTexture(gl: WebGL2RenderingContext): void {
        gl.bindTexture(WebGL2RenderingContext.TEXTURE_2D, null);
    }
    public delete(gl:WebGL2RenderingContext): void {
        gl.deleteTexture(this.texture);
    }
    public static deleteALL(gl:WebGL2RenderingContext): void {
        Texture.textures.reverse().forEach((currentTexture:Texture) => {
            currentTexture.delete(gl);
        });
    }
    public static getTexture(textureID: number): Texture {
        return Texture.textures[textureID];
    }
    public static async loadTexture(gl: WebGL2RenderingContext, textureName: string): Promise<number> {
        return new Promise<number>(async (resolve) => {
            var texture: Texture = new Texture();
            texture.texture = gl.createTexture();
            texture.bindTexture(gl);
            var image: HTMLImageElement = await loadImage(`res/assets/${textureName}.png`);
            gl.texImage2D(WebGL2RenderingContext.TEXTURE_2D, 0, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.RGBA, WebGL2RenderingContext.UNSIGNED_BYTE, image);
            gl.generateMipmap(WebGL2RenderingContext.TEXTURE_2D);
            texture.unbindTexture(gl);
            Texture.textures.push(texture);
            resolve(Texture.textures.length - 1);
        });
    }
}