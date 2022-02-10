class Program{
    shaders:WebGLShader[];
    program:WebGLProgram;
    constructor(shaders:WebGLShader[] = undefined, program:WebGLProgram = undefined){
        this.shaders = shaders;
        this.program = program;
    }
}
async function createContext(): Promise<WebGL2RenderingContext>{
    return new Promise<WebGL2RenderingContext>((resolve, reject) => {
        var canvas:HTMLCanvasElement = document.createElement("canvas");
        canvas.width = screen.width;
        canvas.height = screen.height;
        document.body.appendChild(canvas);
        resolve(canvas.getContext("webgl2"));
    });
}