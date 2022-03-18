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
uniform bool u_disableLighting;

void main(){
    vec3 unitNormal = normalize(out_normal);
    vec3 unitVectorToCamera = normalize(out_surfaceToView);

    vec3 totalDiffuse = vec3(0.0);
    vec3 totalSpecular = vec3(0.0);

    for(int i=0; i<out_lightCount; i++){
        vec3 unitLightVector = normalize(out_surfaceToLight[i]);
        float nDot1 = dot(unitNormal, unitLightVector);
        float brightness = max(nDot1, 0.0);
        brightness *= 0.4;
        vec3 lightDirection = -unitLightVector;
        vec3 reflectedLightDirection = reflect(lightDirection, unitNormal);
        float specularFactor = max(dot(reflectedLightDirection, unitVectorToCamera), 0.0);
        float dampedFactor = pow(specularFactor, 300.0);
        totalDiffuse += brightness * vec3(1.0);
        totalSpecular += dampedFactor * 0.05 * vec3(1.0);
    }
    totalDiffuse = max(totalDiffuse, 0.2);
    vec4 textureColor = texture(u_texture, out_texCord);
    if(u_disableLighting){
        out_color = textureColor * vec4(0.8);
    }else{
        out_color = vec4(totalDiffuse, 1.0) * textureColor + vec4(totalSpecular, 1.0);
    }
}