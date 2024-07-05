import { eventTable, linkedinMediaTable, pendingLinkedinTable, pendingTweetsTable, pendingYoutubeTable, twitterMediaTable, usersTable, youtubeMediaTable } from '../db/schemes';
import { eq } from 'drizzle-orm';
import { google } from 'googleapis';
import { TweetV2PostTweetResult, TwitterApi } from "twitter-api-v2";
import { db } from '../db/db';
import { UTApi } from "uploadthing/server";
import https from "https";
import fs from "fs";

const utapi = new UTApi({ logLevel: "error" });

export async function checkAndPostLinkedin() {
    const pendingLinkedin = await db.select().from(pendingLinkedinTable);

    console.log("[CRONJOB] - Checking for pending linkedin posts");

    if (pendingLinkedin.length === 0) {
        return;
    }

    for (const post of pendingLinkedin) {

        if (post.postingDate > Date.now()) {
            continue;
        }

        const pendingId = post.id;
        const linkedinMedia = await db.select().from(linkedinMediaTable).where(eq(linkedinMediaTable.clerkId, post.clerkId));

        if (!linkedinMedia || linkedinMedia.length === 0) {
            continue;
        }

        const media = linkedinMedia[0];
        const content = post.content ? JSON.parse(post.content) : [];
        const posts = JSON.parse(media.posts!) ?? [];

        if (Date.now() >= media.tokenExpiration!) {
            console.log("[CRONJOB] - Linkedin reauthorization needed");
            continue;
        }

        let body = {};

        switch (content!.shareMediaCategory.toLowerCase() as string) {
            case "none":
                body = {
                    "author": "urn:li:person:" + media.profile_id,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": content.shareCommentary
                            },
                            "shareMediaCategory": content.shareMediaCategory
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
                break;
            case "article":
                body = {
                    "author": "urn:li:person:" + media.profile_id,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": content.shareCommentary
                            },
                            "shareMediaCategory": "ARTICLE",
                            "media": content.media
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
                break;
            case "image":
                body = {
                    "author": "urn:li:person:" + media.profile_id,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": content.shareCommentary
                            },
                            "shareMediaCategory": "IMAGE",
                            "media": content.media
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
                break;
            case "video":
                body = {
                    "author": "urn:li:person:" + media.profile_id,
                    "lifecycleState": "PUBLISHED",
                    "specificContent": {
                        "com.linkedin.ugc.ShareContent": {
                            "shareCommentary": {
                                "text": content.shareCommentary
                            },
                            "shareMediaCategory": "VIDEO",
                            "media": content.media
                        }
                    },
                    "visibility": {
                        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                    }
                }
                break;
            default:
                break;
        }

        const accessToken = media.tokenAccess;

        const postedContent = await fetch('https://api.linkedin.com/v2/ugcPosts', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
                'Content-Type': 'application/json'
            },

            body: JSON.stringify(body)

        });

        if (postedContent.status !== 201) {
            console.error("Error posting content to linkedin");
            console.log(postedContent.statusText);
            continue;
        }

        await postEvent(pendingId);

        const postId = postedContent.headers.get('x-restli-id');

        const impressions = Math.floor(Math.random() * 1000);
        const comments = Math.floor(impressions * 0.1);
        const likes = Math.floor(impressions * 0.2);

        const statisticsObject = {
            "date": Date.now(),
            "impressions": impressions,
            "comments": comments,
            "likes": likes,
        }

        const statisticsArray = [statisticsObject];

        const postObject = {
            id: postId,
            text: content!.shareCommentary,
            date: new Date().getTime(),
            statisticsArray: statisticsArray
        }

        posts.push(postObject);

        await db.update(linkedinMediaTable).set({ posts: JSON.stringify(posts) }).where(eq(linkedinMediaTable.clerkId, post.clerkId));

        await db.delete(pendingLinkedinTable).where(eq(pendingLinkedinTable.id, pendingId));

        console.log("[CRONJOB] - Linkedin post uploaded successfully: ", postId);

    }
}

export async function checkAndPostTweets() {
    const pendingTweets = await db.select().from(pendingTweetsTable);

    console.log("[CRONJOB] - Checking for pending twitter posts");

    if (pendingTweets.length === 0) {
        return;
    }

    for (const tweet of pendingTweets) {

        if (tweet.postingDate > Date.now()) {
            continue;
        }

        const pendingId = tweet.id;
        const twitterMedia = await db.select().from(twitterMediaTable).where(eq(twitterMediaTable.clerkId, tweet.clerkId));


        if (!twitterMedia || twitterMedia.length === 0) {
            continue;
        }

        const media = twitterMedia[0];
        const content = tweet.content ? JSON.parse(tweet.content) : [];
        const posts = JSON.parse(media.posts!) ?? [];

        let tokenAccess = media.tokenAccess;
        let tokenRefresh = media.tokenRefresh;
        let tokenExpiration = media.tokenExpiration;
        let client = new TwitterApi({ clientId: process.env.TWITTER_CLIENT_ID as string, clientSecret: process.env.TWITTER_CLIENT_SECRET as string });

        if (Date.now() >= tokenExpiration!) {  // Token expired so refresh it
            const { client: refreshedClient, accessToken, refreshToken: newRefreshToken, expiresIn } = await client.refreshOAuth2Token(tokenRefresh!);
            client = refreshedClient;
            console.log("[CRONJOB] - Twitter token refreshed successfully: ", accessToken, newRefreshToken, expiresIn);
            await db.update(twitterMediaTable).set({ tokenAccess: accessToken, tokenRefresh: newRefreshToken, tokenExpiration: Date.now() + expiresIn * 1000 }).where(eq(twitterMediaTable.clerkId, tweet.clerkId));
        } else {
            client = new TwitterApi(tokenAccess!);
        }

        let postedTweet: TweetV2PostTweetResult | TweetV2PostTweetResult[] | null = null;

        if (tweet.content!.length > 1) {
            postedTweet = await client.v2.tweetThread(content);
        } else {
            postedTweet = await client.v2.tweet(content.text);
            // client.v2.tweet(tweet.content.text, { poll: { options: [], duration_minutes: 60 } })
        }
        console.log("[CRONJOB] - Twitter post posted successfully: ", postedTweet);

        let tweetId: string;
        let tweetText: string;

        if (Array.isArray(postedTweet)) {
            tweetId = postedTweet[0].data.id;
            tweetText = postedTweet[0].data.text;
        } else {
            tweetId = postedTweet.data.id;
            tweetText = postedTweet.data.text;
        }

        await postEvent(pendingId);

        const impressions = Math.floor(Math.random() * 1000);
        const comments = Math.floor(impressions * 0.1);
        const likes = Math.floor(impressions * 0.2);

        const statisticsObject = {
            "date": Date.now(),
            "impressions": impressions,
            "comments": comments,
            "likes": likes,
        }

        const statisticsArray = [statisticsObject];

        const tweetObject = {
            id: tweetId,
            text: tweetText,
            date: new Date().getTime(),
            statisticsArray: statisticsArray
        }

        posts.push(tweetObject);

        await db.update(twitterMediaTable).set({ posts: JSON.stringify(posts) }).where(eq(twitterMediaTable.clerkId, tweet.clerkId));

        await db.delete(pendingTweetsTable).where(eq(pendingTweetsTable.id, pendingId));

        console.log("[CRONJOB] - Twitter post uploaded successfully: ", tweetObject.id);

    }
}

export async function checkAndPostYoutube() {
    const pendingYoutube = await db.select().from(pendingYoutubeTable);

    console.log("[CRONJOB] - Checking for pending youtube posts");

    if (pendingYoutube.length === 0) {
        return;
    }

    for (const post of pendingYoutube) {

        if (post.postingDate > Date.now()) {
            continue;
        }

        const pendingId = post.id;
        const youtubeMedia = await db.select().from(youtubeMediaTable).where(eq(youtubeMediaTable.clerkId, post.clerkId));

        if (!youtubeMedia || youtubeMedia.length === 0) {
            continue;
        }

        const media = youtubeMedia[0];
        const content = post.content ? JSON.parse(post.content) : [];
        const posts = JSON.parse(media.posts!) ?? [];

        const tokenRefresh = media.tokenRefresh;

        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_CALLBACK_URL
        );

        auth.setCredentials({
            refresh_token: tokenRefresh,
        });

        auth.on('tokens', async (tokens) => {
            if (tokens.access_token) {
                await db.update(youtubeMediaTable).set({ tokenAccess: tokens.access_token, tokenExpiration: tokens.expiry_date }).where(eq(youtubeMediaTable.clerkId, post.clerkId));
            }
        });

        const youtube = google.youtube({
            version: 'v3',
            auth
        });

        const fileUrls = await utapi.getFileUrls([content.mediaKey]);

        const fileUrl = fileUrls.data[0].url;

        const file = fs.createWriteStream("file.mp4");

        await new Promise<void>((resolve, reject) => https.get(fileUrl, (res) => {
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }))

        let body = {};

        switch (content.type.toLowerCase()) {
            case "short":
                body = {
                    part: 'snippet,contentDetails,status',
                    resource: {
                        snippet: {
                            title: content.title,
                            description: content.description,
                            tags: ['shorts'],
                        },
                        status: {
                            privacyStatus: 'public'
                        }
                    },
                    media: {
                        body: fs.createReadStream("file.mp4")
                    }
                }
                break;
            case "video":
                body = {
                    part: 'snippet,contentDetails,status',
                    resource: {
                        snippet: {
                            title: content.title,
                            description: content.description
                        },
                        status: {
                            privacyStatus: 'public'
                        }
                    },
                    media: {
                        body: fs.createReadStream("file.mp4")
                    }
                }
                break;
            default:
                break;
        }

        const postedContent = await youtube.videos.insert(body);

        if (postedContent.status !== 200) {
            console.error("Error posting content to youtube");
            console.log(postedContent);
            continue;
        }

        await utapi.deleteFiles([content.mediaKey]);
        fs.unlinkSync("file.mp4");

        await postEvent(pendingId);

        const impressions = Math.floor(Math.random() * 1000);
        const comments = Math.floor(impressions * 0.1);
        const likes = Math.floor(impressions * 0.2);

        const statisticsObject = {
            "date": Date.now(),
            "impressions": impressions,
            "comments": comments,
            "likes": likes,
        }

        const statisticsArray = [statisticsObject];

        const postObject = {
            id: postedContent.data.id,
            title: content.title,
            description: content.description,
            date: new Date().getTime(),
            statisticsArray: statisticsArray
        }

        posts.push(postObject);

        await db.update(youtubeMediaTable).set({ posts: JSON.stringify(posts) }).where(eq(youtubeMediaTable.clerkId, post.clerkId));

        await db.delete(pendingYoutubeTable).where(eq(pendingYoutubeTable.id, pendingId));

        console.log("[CRONJOB] - Youtube post uploaded successfully: ", postObject.id);
    }
}

export async function checkStatistics() {
    // Twitter
    const twitterMedias = await db.select().from(twitterMediaTable);
    if (twitterMedias.length !== 0) {

        for (const twitterMedia of twitterMedias) {

            let tokenAccess = twitterMedia.tokenAccess;
            let tokenRefresh = twitterMedia.tokenRefresh;
            let tokenExpiration = twitterMedia.tokenExpiration;
            let client = new TwitterApi({ clientId: process.env.TWITTER_CLIENT_ID as string, clientSecret: process.env.TWITTER_CLIENT_SECRET as string });

            if (Date.now() >= tokenExpiration!) {  // Token expired so refresh it
                const { client: refreshedClient, accessToken, refreshToken: newRefreshToken, expiresIn } = await client.refreshOAuth2Token(tokenRefresh!);
                client = refreshedClient;
                await db.update(twitterMediaTable).set({ tokenAccess: accessToken, tokenRefresh: newRefreshToken, tokenExpiration: Date.now() + expiresIn * 1000 }).where(eq(twitterMediaTable.clerkId, twitterMedia.clerkId));
            } else {
                client = new TwitterApi(tokenAccess!);
            }

            const { data: profile } = await client.v2.me({ "user.fields": ["public_metrics"] });

            const followObject = {
                "date": Date.now(),
                "count": profile.public_metrics!.followers_count
            };


            const posts = JSON.parse(twitterMedia.posts!) ?? [];
            const newPosts: any = [];

            for (const post of posts) {

                const statistics = post.statisticsArray;

                const lastStatistics = statistics.pop();

                const newStatistics = {
                    "date": Date.now(),
                    "impressions": Math.floor(Math.random() * 110 + lastStatistics.impressions),
                    "comments": Math.floor(Math.random() * 11 + lastStatistics.comments),
                    "likes": Math.floor(Math.random() * 11 + lastStatistics.likes)
                };

                post.statisticsArray.push(newStatistics);
                newPosts.push(post);
            }

            console.log(`[CRONJOB] - Twitter statistics of user ${twitterMedia.profile_username} updated`);
            const followers = JSON.parse(twitterMedia.profile_followers!) ?? [];
            followers.push(followObject);

            await db.update(twitterMediaTable).set({ profile_followers: JSON.stringify(followers), posts: JSON.stringify(newPosts) }).where(eq(twitterMediaTable.clerkId, twitterMedia.clerkId));
        }
    }
    // Youtube
    const youtubeMedias = await db.select().from(youtubeMediaTable);
    if (youtubeMedias.length !== 0) {

        for (const youtubeMedia of youtubeMedias) {

            const tokenRefresh = youtubeMedia.tokenRefresh;

            const auth = new google.auth.OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                process.env.GOOGLE_CALLBACK_URL
            );

            auth.setCredentials({
                refresh_token: tokenRefresh,
            });

            const youtube = google.youtube({
                version: 'v3',
                auth: auth
            });

            const response = await youtube.channels.list({
                part: ['statistics'],
                mine: true,
            });

            const subscriberCount = response.data.items![0].statistics!.subscriberCount;

            const subscriberObject = {
                "date": Date.now(),
                "count": subscriberCount
            };

            const posts = JSON.parse(youtubeMedia.posts!) ?? [];
            const newPosts: any = [];

            for (const post of posts) {

                const statistics = post.statisticsArray;

                const lastStatistics = statistics.pop();

                const newStatistics = {
                    "impressions": Math.floor(Math.random() * 110 + lastStatistics.impressions),
                    "comments": Math.floor(Math.random() * 11 + lastStatistics.comments),
                    "likes": Math.floor(Math.random() * 11 + lastStatistics.likes),
                    "date": Date.now()
                };

                post.statisticsArray.push(newStatistics);
                newPosts.push(post);
            }

            console.log(`[CRONJOB] - Youtube statistics of user ${youtubeMedia.profile_username} updated`);
            const followers = JSON.parse(youtubeMedia.profile_followers!) ?? [];
            followers.push(subscriberObject);

            await db.update(youtubeMediaTable).set({ profile_followers: JSON.stringify(followers), posts: JSON.stringify(newPosts) }).where(eq(youtubeMediaTable.clerkId, youtubeMedia.clerkId));
        }
    }

    //Linkedin
    const linkedinMedias = await db.select().from(linkedinMediaTable);
    if (linkedinMedias.length !== 0) {
        for (const linkedinMedia of linkedinMedias) {

            const lastFollowerCount = JSON.parse(linkedinMedia.profile_followers!).pop().count;

            const followerObject = {
                "date": Date.now(),
                "count": Math.floor(Math.random() * 11 + lastFollowerCount),
            };

            const posts = JSON.parse(linkedinMedia.posts!) ?? [];
            const newPosts: any = [];

            for (const post of posts) {

                const statistics = post.statisticsArray;

                const lastStatistics = statistics.pop();

                const newStatistics = {
                    "impressions": Math.floor(Math.random() * 110 + lastStatistics.impressions),
                    "comments": Math.floor(Math.random() * 11 + lastStatistics.comments),
                    "likes": Math.floor(Math.random() * 11 + lastStatistics.likes),
                    "date": Date.now()
                };

                post.statisticsArray.push(newStatistics);
                newPosts.push(post);
            }

            console.log(`[CRONJOB] - Linkedin statistics of user ${linkedinMedia.profile_username} updated`);
            const followers = JSON.parse(linkedinMedia.profile_followers!) ?? [];
            followers.push(followerObject);

            await db.update(linkedinMediaTable).set({ profile_followers: JSON.stringify(followers), posts: JSON.stringify(newPosts) }).where(eq(linkedinMediaTable.clerkId, linkedinMedia.clerkId));
        }
    }
}

async function postEvent(pendingId: string) {
    await db.update(eventTable).set({ posted: 1 }).where(eq(eventTable.pendingId, pendingId));
}