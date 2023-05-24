

const { Client } = require('pg') 

const clientURL = process.env.DATABASE_URL || 'postgres://localost:5432/juicebox-dev';
const client = new Client(clientURL);

async function createUser({ 
    username, 
    password,
    name,
    location, }) {
  try {
    const { rows: [ user] } = await client.query(`
      INSERT INTO users(username, password, name, location) 
      VALUES($1, $2, $3, $4) 
      ON CONFLICT (username) DO NOTHING 
      RETURNING *;
    `, [username, password, name, location]);

    return user;
  } catch (error) {
    throw error;
  }
}

async function updateUser(id, fields = {}) {
  
    const setString = Object.keys(fields).map(
      (key, index) => `"${ key }"=$${ index + 1 }`
    ).join(', ');
  
   
    if (setString.length === 0) {
      return;
    }
  
    try {
      const result = await client.query(`
        UPDATE users
        SET ${ setString }
        WHERE id=${ id }
        RETURNING *;
      `, Object.values(fields));
  
      return result;
    } catch (error) {
      throw error;
    }
  }

async function getAllUsers() {
  const { rows: user  } = await client.query(`SELECT id, name, location, active, username FROM users;`, []);

  return user;

}

async function createPost({
    authorId,
    title,
    content,
    tags = [] // this is new
  }) {
    try {
      const { rows: [ post ] } = await client.query(`
        INSERT INTO posts("authorId", title, content) 
        VALUES($1, $2, $3)
        RETURNING *;
      `, [authorId, title, content]);
  
      const tagList = await createTags(tags);
  
      return await addTagsToPost(post.id, tagList);
    } catch (error) {
      throw error;
    }
  }

  async function updatePost(postId, fields = {}) {
    // read off the tags & remove that field 
    const { tags } = fields; // might be undefined
    delete fields.tags;
  
    // build the set string
    const setString = Object.keys(fields).map(
      (key, index) => `"${ key }"=$${ index + 1 }`
    ).join(', ');
  
    try {
      // update any fields that need to be updated
      if (setString.length > 0) {
        await client.query(`
          UPDATE posts
          SET ${ setString }
          WHERE id=${ postId }
          RETURNING *;
        `, Object.values(fields));
      }
  
      // return early if there's no tags to update
      if (tags === undefined) {
        return await getPostById(postId);
      }
  
      // make any new tags that need to be made
      const tagList = await createTags(tags);
      const tagListIdString = tagList.map(
        tag => `${ tag.id }`
      ).join(', ');
  
      // delete any post_tags from the database which aren't in that tagList
      await client.query(`
        DELETE FROM post_tags
        WHERE "tagId"
        NOT IN (${ tagListIdString })
        AND "postId"=$1;
      `, [postId]);
  
      // and create post_tags as necessary
      await addTagsToPost(postId, tagList);

      return await getPostById(postId);
    } catch (error) {
      throw error;
    }
  }
    
        async function getAllPosts() {
            try {
              const { rows: postIds } = await client.query(`
                SELECT id
                FROM posts;
              `);
          
              const posts = await Promise.all(postIds.map(
                post => getPostById( post.id )
              ));
          
              return posts;
            } catch (error) {
              throw error;
            }
          }

          async function getPostsByUser(userId) {
            try {
              const { rows: postIds } = await client.query(`
                SELECT id 
                FROM posts 
                WHERE "authorId"=${ userId };
              `);
          
              const posts = await Promise.all(postIds.map(
                post => getPostById( post.id )
              ));
          
              return posts;
            } catch (error) {
              throw error;
            }
          }
            async function getUserById(userId) {
                try {
                    const { rows: [user] } = await client.query(
                        `SELECT * FROM users
                        WHERE id=${ userId }; `
                    );
                    if (rows.length === 0 ) {
                        return null;
                    } 
                    delete user.password;

                    const posts = getPostsByUser(userId) 
                    user.posts = posts;

                    return user;
                } catch (error) {
                    throw error;
                }
                }

                async function createTags(tagList) {
                    if (tagList.length === 0) { 
                      return; 
                    }
                  
                    // need something like: $1), ($2), ($3 
                    const insertValues = tagList.map(
                      (_, index) => `$${index + 1}`).join('), (');
                    // then we can use: (${ insertValues }) in our string template
                  
                    // need something like $1, $2, $3
                    const selectValues = tagList.map(
                      (_, index) => `$${index + 1}`).join(', ');
                    // then we can use (${ selectValues }) in our string template
                  
                    try {
                      // insert the tags, doing nothing on conflict
                      // returning nothing, we'll query after
                  
                      // select all tags where the name is in our taglist
                      // return the rows from the query
                    } catch (error) {
                      throw error;
                    }
                  }

                  async function createPostTag(postId, tagId) {
                    try {
                      await client.query(`
                        INSERT INTO post_tags("postId", "tagId")
                        VALUES ($1, $2)
                        ON CONFLICT ("postId", "tagId") DO NOTHING;
                      `, [postId, tagId]);
                    } catch (error) {
                      throw error;
                    }
                  }

                  async function addTagsToPost(postId, tagList) {
                    try {
                      const createPostTagPromises = tagList.map(
                        tag => createPostTag(postId, tag.id)
                      );
                  
                      await Promise.all(createPostTagPromises);
                  
                      return await getPostById(postId);
                    } catch (error) {
                      throw error;
                    }
                  }

                  async function getPostById(postId) {
                    try {
                      const { rows: [ post ]  } = await client.query(`
                        SELECT *
                        FROM posts
                        WHERE id=$1;
                      `, [postId]);
                  
                      const { rows: tags } = await client.query(`
                        SELECT tags.*
                        FROM tags
                        JOIN post_tags ON tags.id=post_tags."tagId"
                        WHERE post_tags."postId"=$1;
                      `, [postId])
                  
                      const { rows: [author] } = await client.query(`
                        SELECT id, username, name, location
                        FROM users
                        WHERE id=$1;
                      `, [post.authorId])
                  
                      post.tags = tags;
                      post.author = author;
                  
                      delete post.authorId;
                  
                      return post;
                    } catch (error) {
                      throw error;
                    }
                  }

                  async function createInitialTags() {
                    try {
                      console.log("Starting to create tags...");
                  
                      const [happy, sad, inspo, catman] = await createTags([
                        '#happy', 
                        '#worst-day-ever', 
                        '#youcandoanything',
                        '#catmandoeverything'
                      ]);
                  
                      const [postOne, postTwo, postThree] = await getAllPosts();
                  
                      await addTagsToPost(postOne.id, [happy, inspo]);
                      await addTagsToPost(postTwo.id, [sad, inspo]);
                      await addTagsToPost(postThree.id, [happy, catman, inspo]);
                  
                      console.log("Finished creating tags!");
                    } catch (error) {
                      console.log("Error creating tags!");
                      throw error;
                    }
                  }

                  async function getPostsByTagName(tagName) {
                    try {
                      const { rows: postIds } = await client.query(`
                        SELECT posts.id
                        FROM posts
                        JOIN post_tags ON posts.id=post_tags."postId"
                        JOIN tags ON tags.id=post_tags."tagId"
                        WHERE tags.name=$1;
                      `, [tagName]);
                  
                      return await Promise.all(postIds.map(
                        post => getPostById(post.id)
                      ));
                    } catch (error) {
                      throw error;
                    }
                  } 
            
                  

module.exports = {  
    client,
    createUser,
    updateUser,
    getAllUsers,
    getUserById,
    createPost,
    updatePost,
    getAllPosts,
    getPostsByUser, 
    createInitialTags,
    getPostsByTagName
}