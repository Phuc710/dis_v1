console.log('Testing encryption libraries...');

try {
    require('sodium-native');
    console.log('✅ sodium-native works');
} catch (e) {
    console.log('❌ sodium-native failed:', e.message);
}

try {
    require('tweetnacl');
    console.log('✅ tweetnacl works');
} catch (e) {
    console.log('❌ tweetnacl failed:', e.message);
}

try {
    require('@discordjs/voice');
    console.log('✅ @discordjs/voice works');
} catch (e) {
    console.log('❌ @discordjs/voice failed:', e.message);
}