import { Context } from "hono";
import { escapeLikePattern, handleMailListQuery } from "../common";
import { resolveRawEmailRow } from "../gzip";

export default {
    getMails: async (c: Context<HonoCustomType>) => {
        const { address, limit, offset, keyword } = c.req.query();
        const filterQuerys: string[] = [];
        const filterParams: string[] = [];
        if (address) {
            filterQuerys.push(`address = ?`);
            filterParams.push(address);
        }
        const trimmedKeyword = (keyword || '').trim();
        if (trimmedKeyword) {
            const pattern = escapeLikePattern(trimmedKeyword);
            filterQuerys.push(`(source LIKE ? ESCAPE '\\' or address LIKE ? ESCAPE '\\' or raw LIKE ? ESCAPE '\\')`);
            filterParams.push(pattern, pattern, pattern);
        }
        const finalQuery = filterQuerys.length > 0 ? `where ${filterQuerys.join(" and ")}` : "";
        return await handleMailListQuery(c,
            `SELECT * FROM raw_mails ${finalQuery}`,
            `SELECT count(*) as count FROM raw_mails ${finalQuery}`,
            filterParams, limit, offset
        );
    },
    getUnknowMails: async (c: Context<HonoCustomType>) => {
        const { limit, offset } = c.req.query();
        return await handleMailListQuery(c,
            `SELECT * FROM raw_mails where address NOT IN (select name from address) `,
            `SELECT count(*) as count FROM raw_mails`
            + ` where address NOT IN (select name from address) `,
            [], limit, offset
        );
    },
    getMail: async (c: Context<HonoCustomType>) => {
        const { id } = c.req.param();
        const result = await c.env.DB.prepare(
            `SELECT * FROM raw_mails WHERE id = ?`
        ).bind(id).first();
        if (!result) return c.json(null);
        return c.json(await resolveRawEmailRow(result));
    },
    deleteMail: async (c: Context<HonoCustomType>) => {
        const { id } = c.req.param();
        const { success } = await c.env.DB.prepare(
            `DELETE FROM raw_mails WHERE id = ? `
        ).bind(id).run();
        return c.json({
            success: success
        })
    }
}
