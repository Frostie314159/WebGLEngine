precision mediump float;

in vec3 out_col;

out vec4 out_Color;

uniform float u_alpha;
void main(){
    out_Color = vec4(out_col, u_alpha);
}