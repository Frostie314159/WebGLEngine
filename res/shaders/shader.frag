precision highp float;

in vec3 out_normal;
in vec2 out_texCord;

out vec4 out_color;

uniform vec3 u_reverseLightDirection;
uniform sampler2D u_texture;

void main(){
    vec3 normalized = normalize(out_normal);
    float light = dot(normalized, u_reverseLightDirection);
    out_color = texture(u_texture, out_texCord);
    out_color.rgb *= max(light, 0.2);
}