import {
    Button,
    Group,
    Modal,
    PasswordInput,
    Stack,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';

type Props = {
    opened: boolean;
    onClose: () => void;
};

export function ChangePasswordModal({ opened, onClose }: Props) {
    const [loading, setLoading] = useState(false);

    const form = useForm({
        initialValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        },
        validate: {
            currentPassword: (value) => (value ? null : '現在のパスワードは必須です'),
            newPassword: (value) => (value.length >= 8 ? null : 'パスワードは8文字以上で入力してください'),
            confirmPassword: (value, values) =>
                value === values.newPassword ? null : 'パスワードが一致しません',
        },
    });

    const handleSubmit = async (values: typeof form.values) => {
        setLoading(true);
        try {
            const res = await fetch('/api/me/password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    currentPassword: values.currentPassword,
                    newPassword: values.newPassword,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'パスワード変更に失敗しました');
            }

            notifications.show({
                title: '成功',
                message: 'パスワードを変更しました',
                color: 'teal',
            });
            form.reset();
            onClose();
        } catch (e) {
            notifications.show({
                title: 'エラー',
                message: e instanceof Error ? e.message : 'エラーが発生しました',
                color: 'red',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal opened={opened} onClose={onClose} title="パスワード変更" centered>
            <form onSubmit={form.onSubmit(handleSubmit)}>
                <Stack>
                    <PasswordInput
                        label="現在のパスワード"
                        required
                        {...form.getInputProps('currentPassword')}
                    />
                    <PasswordInput
                        label="新しいパスワード"
                        description="8文字以上"
                        required
                        {...form.getInputProps('newPassword')}
                    />
                    <PasswordInput
                        label="新しいパスワード（確認）"
                        required
                        {...form.getInputProps('confirmPassword')}
                    />
                    <Group justify="flex-end">
                        <Button variant="default" onClick={onClose}>
                            キャンセル
                        </Button>
                        <Button type="submit" loading={loading}>
                            変更する
                        </Button>
                    </Group>
                </Stack>
            </form>
        </Modal>
    );
}
