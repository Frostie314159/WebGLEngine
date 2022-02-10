class Program{
    shaders:WebGLShader[];
    program:WebGLProgram;
    constructor(shaders:WebGLShader[] = undefined, program:WebGLProgram = undefined){
        this.shaders = shaders;
        this.program = program;
    }
    public static async loadProgram(gl:WebGL2RenderingContext, name:string): Promise<WebGLProgram>{
        return new Promise<Program>((resolve, reject) => {
            var program:Program = new Program(undefined, gl.createProgram());
        })
    }
}
async function loadFile(url:string): Promise<string>{
    return new Promise<string>(async (resolve, reject) => {
        fetch(url).then(async (response:Response) => {
            if(response.ok){
                resolve(await response.text());
            }else{
                reject(new Error(`HTTP Response code for file ${url}: ${response.status}-${response.statusText}!`))
            }
        });
    })
}
async function createContext(): Promise<WebGL2RenderingContext>{
    return new Promise<WebGL2RenderingContext>((resolve, reject) => {
        var canvas:HTMLCanvasElement = document.createElement("canvas");
        canvas.width = screen.width;
        canvas.height = screen.height;
        document.body.appendChild(canvas);
        let gl:WebGL2RenderingContext = canvas.getContext("webgl2");
        if(gl){
            resolve(gl);
        }else{
            reject(new Error("Couldn't acquire WebGL2Context!"));
        }
    });
}
async function main():Promise<void> {
    console.log(await createContext());
}