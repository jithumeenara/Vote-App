export function transliterateMalayalamToEnglish(text) {
    if (!text) return '';

    const mapping = {
        // Vowels
        'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo', 'ഋ': 'ru',
        'എ': 'e', 'ഏ': 'e', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'o', 'ഔ': 'au',

        // Consonants
        'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng',
        'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'nj',
        'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n',
        'ത': 'th', 'ഥ': 'th', 'ദ': 'd', 'ധ': 'dh', 'ന': 'n',
        'പ': 'p', 'ഫ': 'f', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm',
        'യ': 'y', 'ര': 'r', 'ല': 'l', 'വ': 'v', 'ശ': 'sh', 'ഷ': 'sh', 'സ': 's', 'ഹ': 'h',
        'ള': 'l', 'ഴ': 'zh', 'റ': 'r',

        // Chillus
        'ൺ': 'n', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൿ': 'k',

        // Others
        'ം': 'm', 'ഃ': 'h'
    };

    const matras = {
        'ാ': 'a', 'ി': 'i', 'ീ': 'ee', 'ു': 'u', 'ൂ': 'oo', 'ൃ': 'ru',
        'െ': 'e', 'േ': 'e', 'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'o', 'ൗ': 'au',
        '്': '', // Virama
        '\u200C': '', // ZWNJ
        '\u200D': ''  // ZWJ
    };

    let result = '';
    const chars = text.split('');

    for (let i = 0; i < chars.length; i++) {
        const char = chars[i];
        const nextChar = chars[i + 1];

        if (mapping[char]) {
            result += mapping[char];

            // Handle inherent 'a' for consonants
            // If it's a consonant (not a vowel/chillus/other which are also in mapping but handled differently conceptually)
            // Actually, my mapping includes vowels too.
            // Logic: If char is a consonant AND next char is NOT a matra AND next char is NOT a virama, add 'a'.

            const isConsonant = (char >= 'ക' && char <= 'ഹ') || (char >= 'ള' && char <= 'റ');

            if (isConsonant) {
                if (!nextChar || (!matras[nextChar] && nextChar !== '്')) {
                    // Check if next char is also a valid Malayalam char (to avoid adding 'a' at the very end if it's not standard? No, usually ends with 'a' if no virama)
                    // But names like "Suresh" in Malayalam is "സുരേഷ്". The last char is 'ഷ' + '്'. So 'sh' + ''. Correct.
                    // "Ram" -> "റാം". 'റ' + 'ാ' + 'ം'. 'r' + 'a' + 'm'. Correct.
                    // "Rama" -> "രാമ". 'ര' + 'ാ' + 'മ'. 'r' + 'a' + 'm' + 'a'. Correct.
                    result += 'a';
                }
            }
        } else if (matras[char] !== undefined) {
            result += matras[char];
        } else {
            // Keep other characters (numbers, spaces, English) as is
            result += char;
        }
    }

    return result;
}
