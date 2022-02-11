precision mediump float;
in vec3 out_col;
out vec4 out_Color;
void main(){
    out_Color = vec4(out_col, 1.0);
}