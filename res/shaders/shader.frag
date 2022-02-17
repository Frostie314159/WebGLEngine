precision highp float;

in vec3 out_normal;

out vec4 out_color;

uniform vec3 u_reverseLightDirection;

void main(){
    vec3 normalized = normalize(out_normal);
    float light = dot(normalized, u_reverseLightDirection);
    out_color = vec4(1.0);
    out_color.rgb *= max(light, 0.2);
}