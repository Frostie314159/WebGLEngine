precision mediump float;

#define MAX_LIGHTS 8
in vec3 out_normal;
in vec2 out_texCord;
flat in int out_lightCount;
in vec3 out_surfaceToLight[MAX_LIGHTS];
in vec3 out_surfaceToView;

out vec4 out_color;

uniform vec3 u_reverseLightDirection;
uniform sampler2D u_texture;

void main(){
    float light = 0.0;
    float specular = 0.0;
    vec3 normalized = normalize(out_normal);
    light += dot(normalized, u_reverseLightDirection);
    for(int i=0; i<out_lightCount; i++){
        light += dot(normalized, normalize(out_surfaceToLight[i]));
        if(light > 0.0){
            specular += pow(dot(normalized, normalize(out_surfaceToLight[i]) + normalize(out_surfaceToView)), 150.0);
        }
    }
    out_color = texture(u_texture, out_texCord);
    out_color.rgb *= max(light, 0.1);
    //out_color.rgb += specular;
}