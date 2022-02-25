precision mediump float;

in vec2 out_texCord;

out vec4 out_Color;

uniform sampler2D u_texture;

void main(){
    out_Color = texture(u_texture, out_texCord);
}