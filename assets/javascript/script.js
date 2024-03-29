function getMatch(faceResponse) {
    const emotions = faceResponse.faces[0].attributes.emotion;

    const transform = {
        anger: "yandere",
        neutral: "mecha",
        disgust: "tsundere",
        sadness: "catgirl",
        fear: "yandere",
        happiness: "gyaru",
        surprise: "magical girl",
    };

    let rand = Math.random() * 100;

    const emotion = (function getEmotion(emotions) {
        for (e in emotions) {
            rand -= emotions[e];
            if (rand <= 0) {
                return e;
            }
        }
    })(emotions);

    console.log(emotion);

    const key = transform[emotion];
    const queryString =
        "https://api.jikan.moe/v3/search/character/?" + $.param({ q: key });

    console.log(queryString);

    return $.get(queryString)
        .then(function (results) {
            const resultCount = results.results.length;

            let sample = getRandom(
                filterRepeats(results.results),
                resultCount > 9 ? 10 : resultCount
            );
            console.log(sample);

            if (!sample) {
                // If we have exhausted the results of this query, make a new one
                return getMatch(faceResponse);
            }

            return Promise.all(
                sample.map(async (item, index) => {
                    // Will return an array of ajax promises
                    console.log(item, index);
                    await new Promise(resolve => setTimeout(resolve, 550 * index));
                    console.log(`sending ${item} ${index}`);
                    return $.get(`https://api.jikan.moe/v3/character/${item.mal_id}`);
                })
            );
        })
        .then(
            // return of function will be promise-ified
            function (results) {
                // parse and filter results
                console.log("debug");
                console.log(results);
                results = results.map(result => {
                    console.log(result);
                    const obj = parseAbout(result.about);
                    obj.name = result.name;
                    obj.featured = result.animeography;
                    obj.image_url = result.image_url;
                    return obj;
                });
                console.log(results);
                results = profileFilters.reduce(
                    (a, filter) => a.filter(filter),
                    results
                );
                return results.map(p => new Profile(p));
            }
        );
}

// TODO find and fix the regex that is taking approximately until the end of time to calculate.
// parse the 'about' string  we get from our ajax requests
function parseAbout(about) {
    // VNDB formatted bio
    // console.log(about);
    // console.log([...about].map(x => x.charCodeAt(0)));
    let match = about.match(
        /^(?<stats>(?:[a-zA-z0-9- ]+:.+\r?\n?)+)(?<about>(?:.+\r?\n?)+)?/i
    );
    console.log(match);
    if (match) {
        const output = {};
        const stats = match.groups.stats;
        output.stats = {
            hair: stats.match(/Hair:\s?(.*[a-zA-z]*?)/),
            eyes: stats.match(/Eyes:\s?(.*[a-zA-z]*?)/),
            clothes: stats.match(/Clothes:\s?(.*[a-zA-z]*?)/),
            personality: stats.match(/Personality:\s?(.*[a-zA-z]*?)/),
            role: stats.match(/Role:\s?(.*[a-zA-z]*?)/),
            height: stats.match(/Height:\s?(.*[a-zA-z]*?)/),
            measurements: stats.match(
                /(?:Bust-Waist-Hips|B-W-H|Three sizes):\s?(.*[a-zA-z]*?)/
            ),
            age: stats.match(/Age:\s?(.*\w*?)/),
            birthday: stats.match(/Birthday:\s?(.*[a-zA-z]*?)/),
            subjectOf: stats.match(/Subject of:\s?(.*[a-zA-z]*?)/)
        };
        Object.keys(output.stats).forEach(
            k => (output.stats[k] = output.stats[k] && output.stats[k][1])
        );

        output.about =
            match.groups.about &&
            match.groups.about.replace(/\(Source:.+\).*|No voice.*/i, "");
        output.raw = about;
        output.source =
            match.groups.about &&
            match.groups.about.match(/\(Source:.+\).*|No voice.*/i);
        output.source = output.source && output.source[0];

        return output;
    }
    // other bios
    console.log(about);
    match = about.match(
        /(?<about>(?:.+\r?\n?)+?)(?<source>(?:\(Source:.+\).*|No voice.*))?/
    );
    console.log(match);
    if (match) {
        output = {
            about: match.groups.about,
            source: match.groups.source,
            raw: about
        };

        let age = match.groups.about.match(/(\d*) years? old/i);
        if (age) {
            output.stats = { age: age[1] };
        } else {
            age = match.groups.about.match(/age:\s?(\d*)/i)
            if (age) {
                output.stats = { age: age[1] };
            }
        }

        output.about =
            output.about && output.about.replace(/\(Source:.+\).*|No voice.*/i, "");

        return output;
    }
}

// https://stackoverflow.com/questions/19269545/how-to-get-n-no-elements-randomly-from-an-array
function getRandom(arr, n) {
    var result = new Array(n),
        len = arr.length,
        taken = new Array(len);
    if (n > len) return false;
    while (n--) {
        var x = Math.floor(Math.random() * len);
        result[n] = arr[x in taken ? taken[x] : x];
        taken[x] = --len in taken ? taken[len] : len;
    }
    return result;
}

// function filterRepeats(arr) {
//     return arr.filter(character => {
//         loadedProfiles.forEach(profile => {
//             const profName = profile.name.replace(',', '').split(' ');
//             const charName = character.name.replace(',', '').split(' ');
//             console.log(profName, charName);
//             if ((profName[0] == charName[0] && profName[1] == charName[1]) ||
//                 (profName[0] == charName[1] && profName[1] == charName[0])) {
//                 return false;
//             }
//         });
//         return true;
//     })
// }

function filterRepeats(arr) {
    return arr.filter(character => {
        if (loadedNames.has(character.name)) {
            return false;
        } else {
            loadedNames.add(character.name);
            return true;
        }
    });
}

let loadedProfiles = new Set([]);
let loadedNames = new Set([]);
let loading = false;
let faceData;

function loadMore() {
    drawLoadScreen();
    getMatch(faceData).then(function (results) {
        $("#loading-card").remove();
        results.forEach(result => loadedProfiles.add(result));
        $("#profile-space").append(
            ...results.map(profile => {
                return profile.buildNode();
            })
        );
        loading = false;
    });
}

function drawLoadScreen() {
    if (!loading) {
        loading = true;
        $('#profile-space').append(
            $('<div>').addClass('profile').attr('id', 'loading-card').append(
                $('<div class="loading-filler">'),
                $('<progress class="progress is-small is-primary loading-bar" max="100">')
            )
        );
    }
}

// // for debugging
// getMatch(faceData).then(
//     function (results) {
//         console.log(results);
//         results.forEach(result => loadedProfiles.add(result));
//         $('#profile-space').append(
//             ...results.map(profile => {
//                 return profile.buildNode()
//             })
//         );
//     }
// )

// loadMore();

function requestFaceData(selectImgFile) {
    let data = new FormData();
    data.append("api_key", "ck3PwAKq4ZDsnbx77dyZG3lEk_YDwCIz");
    data.append("api_secret", "Epcw27lJerS2w28JQvd2DYhG_Rs-LjFJ");
    //data.append("image_url", "https://cdn.cnn.com/cnnnext/dam/assets/190802164147-03-trump-rally-0801-large-tease.jpg");
    data.append("image_file", selectImgFile);
    data.append(
        "return_attributes",
        "gender,age,smiling,headpose,emotion,ethnicity,mouthstatus,eyegaze"
    );

    console.log(data);
    return $.ajax({
        url: "https://api-us.faceplusplus.com/facepp/v3/detect",
        method: "POST",
        contentType: false,
        mimeType: "multipart/form-data",
        processData: false,
        data: data
    });
}

function drawLogo() {
    const svg = `<svg height="63" width="68.4" viewbox="0 0 342 315" transform="rotate(-135) translate(5 5)">
    <defs>
        <style type="text/css">
            <![CDATA[
                .outline {
                    stroke: none;
                    stroke-width: 0
                }

                .a {
                    font: montserrat;
                    font-size: 130pt;
                }
            ]]>
        </style>
        <filter id="f3" x="0" y="0" width="200%" height="200%">
            <feOffset result="offOut" in="SourceGraphic" dx="20" dy="20" />
            <feColorMatrix result="matrixOut" in="offOut" type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" />
            <feGaussianBlur result="blurOut" in="matrixOut" stdDeviation="10" />
            <feBlend in="SourceGraphic" in2="blurOut" mode="normal" />
        </filter>
        <g id="heart2">
            <path d="M0 200 v-200 h200 
                    a100,100 90 0,1 0,200
                    a100,100 90 0,1 -200,0
                    z" />
            <text x="-70" y="-100" z="2" class="a" fill="white" transform="rotate(135)">ア</text>
        </g>
    </defs>
    <desc>
        a nearly perfect heart
        made of two arcs and a right angle
    </desc>
    <use xlink:href="#heart2" class="outline " fill="purple" />
</svg>`

    return $('<div class="logo-full">').append(
        $(svg),
        $('<span class="logo-text">').text('nimingle')
    )
}

let leftButtonStatus = false;
let rightButtonStatus = true;
let scrollSnapEnabled = true;

let currentPage = 0;
function setupProfileSpace() {
    $('#display-area').empty().css({ height: 'initial' }).append(
        $('<div>').addClass('scroll-button-wrapper scroll-left').append(
            $('<a>').addClass('button scroll-button is-static').attr('data-scroll', '-1').append(
                $('<i class="fas fa-angle-left">')
            )
        ),
        $('<div>').attr('id', 'profile-space'),
        $('<div>').addClass('scroll-button-wrapper scroll-right').append(
            $('<a>').addClass('button scroll-button').attr('data-scroll', '1').append(
                $('<i class="fas fa-angle-right">')
            )
        ),
    )
    $('#profile-space').scrollLeft(0);

    // bind events
    $('#profile-space').on('scroll', function (event) {
        const margin = parseInt($('.profile').css('margin-left').replace('px', '') * 2);
        const profileSpace = $('#profile-space')
        const width = profileSpace.width() + margin;
        let page = (profileSpace.scrollLeft() + margin / 2) / width;
        const pageInt = Math.floor(page);
        const pageCiel = Math.ceil(page);
        if (pageInt <= 0 && leftButtonStatus) {
            leftButtonStatus = false;
            $('.scroll-button-wrapper.scroll-left .button').addClass('is-static');
        } else if (pageInt != 0 && !leftButtonStatus) {
            leftButtonStatus = true;
            $('.scroll-button-wrapper.scroll-left .button').removeClass('is-static');
        }

        if (pageCiel == loadedProfiles.size && rightButtonStatus) {
            rightButtonStatus = false;
            $('.scroll-button-wrapper.scroll-right button').addClass('is-static');
        } else if (pageCiel != loadedProfiles.size && !rightButtonStatus) {
            rightButtonStatus = true;
            $('.scroll-button-wrapper.scroll-right button').removeClass('is-static');
        }

        if (scrollSnapEnabled) {
            if ((Math.abs(page - currentPage) > 1)) {

                page = Math.floor(page) + (currentPage - page > 1 ? 1 : 0);
                profileSpace.css({ 'overflow-x': 'hidden' });
                setTimeout(function () {
                    $('#profile-space').css({ 'overflow-x': '' })
                }, 10);

                profileSpace.scrollLeft(page * width - margin / 2);
                console.log('scrolling locked to page ' + page)
            }
        }

        if (!(page % 1) && page != currentPage) { // we have scrolled to a new page
            console.log(page);
            console.log(currentPage);
            $(`#profile-space .profile:nth-child(${currentPage + 1})`).scrollTop(0);
            currentPage = page;
            if (page == loadedProfiles.size - 1 && !loading) {
                loadMore();
            }
        }

        if (pageCiel == loadedProfiles.size && !loading) { // We have just scrolled to the last page
            loadMore();
        }
    });
    $('.scroll-button').on('click', function (event) {
        console.log('scroll');
        scrollSnapEnabled = false;
        new Promise(resolve => setTimeout(resolve, 100)).then(
            x => scrollSnapEnabled = true
        )
        const profileSpace = $('#profile-space');
        const scrollIncrement = profileSpace.width();
        profileSpace.scrollLeft(profileSpace.scrollLeft() + parseInt($(this).attr('data-scroll')) * scrollIncrement);
    });
}

$('#about-button').on('click', function () {
    $('.modal').toggleClass('is-active');
});

$('.delete').on('click', function () {
    $('.modal').toggleClass('is-active');
})

$('#splash-button').on('click', function () {
    $('input[type=file]').trigger('click');
});

$('#home-button').on('click', function () {
    console.log('debug');
    location.reload();
});

$('input[type=file]').change(function (e) {
    // const vals = $(this).val();
    // val = vals.length ? vals.split('\\').pop() : '';
    // const fr = new FileReader();
    // const bin = fr.readAsBinaryString(val);
    const path = $(this).val();
    const match = path.match(/\.(png|jpg|jpeg|gif)$/);
    if (match) {
        setupProfileSpace();
        drawLoadScreen();
        $('#profile-space').scrollLeft(0);
        requestFaceData(e.target.files[0]).then(
            function (results) {
                faceData = JSON.parse(results);
                loadMore();
            }
        );
    }
});

$(document).ready(function () {
    $('#splashTitle').empty().append(drawLogo());
});
