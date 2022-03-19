#define MAX_LIGHTS 8
in vec4 POSITION;
in vec3 NORMAL;
in vec2 TEXCOORD_0;

out vec3 out_normal;
out vec2 out_texCord;
flat out int out_lightCount;
out vec3 out_surfaceToLight[MAX_LIGHTS];
out vec3 out_surfaceToView;

uniform int u_lightCount;
uniform vec3 u_lightPositions[MAX_LIGHTS];
uniform vec3 u_viewWorldPosition;
uniform mat4 u_world;
uniform mat4 u_projectionView;

void main(){
    out_normal = mat3(transpose(inverse(u_world))) * NORMAL;
    out_texCord = TEXCOORD_0;
    gl_Position = u_projectionView * u_world * POSITION;
    out_lightCount = u_lightCount;
    vec3 surfaceWorldPosition = (u_world * POSITION).xyz;
    for(int i=0; i<u_lightCount; i++){
        out_surfaceToLight[i] = u_lightPositions[i] - surfaceWorldPosition;
    }
    out_surfaceToView = u_viewWorldPosition - surfaceWorldPosition;
}